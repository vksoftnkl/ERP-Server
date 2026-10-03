import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { SaveBillAdjustmentDto } from './save-bill-adjustment.dto';
import { SaveBillDto } from './save-bill.dto';
export declare class BillKeysDto {
    sbId: string;
    sbCompanyId: string;
    sbBranchId: string;
    sbAccYear: string;
}
export declare class ValidateBillDto extends SaveBillDto {
    overrides?: string[];
}
export declare class PostBillDto extends BillKeysDto {
    overrides?: string[];
    printAfter?: boolean;
    adjustments?: SaveBillAdjustmentDto[];
}
export declare class CancelBillDto extends BillKeysDto {
    reason: string;
}
export declare class AmendBillDto extends ValidateBillDto {
    sbId: string;
    baseRevision: number;
    editRemark: string;
    printAfter?: boolean;
}
export declare class DeleteBillDto extends BillKeysDto {
}
export declare const DELIVERY_EVENTS: readonly ["VERIFIED", "PACKED", "DISPATCHED", "DELIVERED"];
export type DeliveryEvent = (typeof DELIVERY_EVENTS)[number];
export declare class DeliveryStatusDto extends BillKeysDto {
    event: DeliveryEvent;
    remarks?: string | null;
    vehicleNo?: string | null;
    lrNo?: string | null;
}
export declare class UpdateRemarksDto extends BillKeysDto {
    sbRemarks?: string | null;
    editRemark: string;
}
export declare class TransportEndDto {
    godownId?: string | null;
    branchId?: string | null;
    addrId?: string | null;
    name?: string | null;
    addr?: string | null;
    place?: string | null;
    pin?: string | null;
    phone?: string | null;
    stcd?: string | null;
    gstin?: string | null;
}
export declare const TRANSPORT_DIRECTIONS: readonly ["OUTWARD", "INWARD"];
export declare class TransportBandDto {
    direction: 'OUTWARD' | 'INWARD';
    from?: TransportEndDto | null;
    to?: TransportEndDto | null;
    mode?: string | null;
    transporterId?: string | null;
    transporterName?: string | null;
    transporterGstin?: string | null;
    lrNo?: string | null;
    lrDate?: string | null;
    distanceKm?: number | null;
    remarks?: string | null;
}
export declare class BillTransportDto extends BillKeysDto {
    transport: TransportBandDto;
}
export declare const VOID_REASONS: readonly ["UPI_FAILED", "CARD_DECLINED", "CHEQUE_REFUSED", "KEYED_WRONG", "CUSTOMER_CHANGED", "OTHER"];
export declare class RetenderVoidDto {
    tdId: string;
    reason: (typeof VOID_REASONS)[number];
}
export declare class RetenderBillDto extends BillKeysDto {
    voids: RetenderVoidDto[];
    tenders: SaveTenderDetailDto[];
    remark: string;
}
