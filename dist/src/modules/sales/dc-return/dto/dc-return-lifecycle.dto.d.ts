import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
export declare class DcReturnKeysDto {
    sdrId: string;
    sdrCompanyId: string;
    sdrBranchId: string;
    sdrAccYear: string;
}
export declare class PostDcReturnDto extends DcReturnKeysDto {
}
export declare class CancelDcReturnDto extends DcReturnKeysDto {
    reason: string;
}
export declare class DcReturnTransportDto extends DcReturnKeysDto {
    transport: TransportBandDto;
}
