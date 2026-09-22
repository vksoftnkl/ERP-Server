import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDeliveryChallanDto } from './save-delivery-challan.dto';
export declare class DeliveryChallanKeysDto {
    sdcId: string;
    sdcCompanyId: string;
    sdcBranchId: string;
    sdcAccYear: string;
}
export declare class ValidateDeliveryChallanDto extends SaveDeliveryChallanDto {
    overrides?: string[];
}
export declare class PostDeliveryChallanDto extends DeliveryChallanKeysDto {
    overrides?: string[];
    printAfter?: boolean;
}
export declare class CancelDeliveryChallanDto extends DeliveryChallanKeysDto {
    reason: string;
}
export declare class AmendDeliveryChallanDto extends ValidateDeliveryChallanDto {
    sdcId: string;
    baseRevision: number;
    editRemark: string;
}
export declare const DC_PURPOSES: readonly ["SUPPLY", "JOB_WORK", "APPROVAL", "EXHIBITION", "OWN_USE", "LINE_SALES", "OTHER"];
export declare class ConvertPurposeDto extends DeliveryChallanKeysDto {
    purpose: (typeof DC_PURPOSES)[number];
    remark: string;
}
export declare class DeliveryChallanTransportDto extends DeliveryChallanKeysDto {
    transport: TransportBandDto;
}
