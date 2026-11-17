import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDcReturnDto } from './save-dc-return.dto';
export declare class DcReturnKeysDto {
    sdrId: string;
    sdrCompanyId: string;
    sdrBranchId: string;
    sdrAccYear: string;
}
export declare class PostDcReturnDto extends DcReturnKeysDto {
    printAfter?: boolean;
    overrides?: string[];
}
export declare class ValidateDcReturnDto extends SaveDcReturnDto {
}
export declare class DcReturnOpenLinesQueryDto {
    companyId: string;
    branchId: string;
    sdcId: string;
    sdcAccYear: string;
}
export declare class CancelDcReturnDto extends DcReturnKeysDto {
    reason: string;
}
export declare class DcReturnTransportDto extends DcReturnKeysDto {
    transport: TransportBandDto;
}
