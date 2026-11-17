export declare class DeliveryNoteLineDto {
    sdniId?: string;
    billId: string;
    billAccYear: string;
    billItemId: string;
    godownId?: string;
    lotId?: string | null;
    qty: string;
    scannedQty?: string;
    otherGodownOk?: boolean;
    remarks?: string | null;
}
export declare class DeliveryNoteTransportDto {
    transporterId?: string | null;
    transporterName?: string | null;
    lrNo?: string | null;
    lrDate?: string | null;
}
export declare class SaveDeliveryNoteDto {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    sdnId?: string;
    baseRevision?: number;
    sdnGodownId?: string;
    sdnMode: string;
    sdnVehicleId?: string | null;
    sdnVehicleNo?: string | null;
    sdnDriverId?: string | null;
    sdnLoadmanIds?: string[];
    sdnSupervisorId?: string | null;
    sdnCollectedBy?: string | null;
    sdnCollectorPhone?: string | null;
    transport?: DeliveryNoteTransportDto | null;
    sdnRemarks?: string | null;
    lines: DeliveryNoteLineDto[];
}
export declare class ValidateDeliveryNoteDto extends SaveDeliveryNoteDto {
    overrideWarnings?: string[];
}
export declare class PostDeliveryNoteDto extends SaveDeliveryNoteDto {
    overrideWarnings?: string[];
}
export declare class DeliveryNoteKeysDto {
    companyId: string;
    branchId: string;
    accYear: string;
    sdnId: string;
}
export declare class CancelDeliveryNoteDto extends DeliveryNoteKeysDto {
    reason?: string;
}
export declare class GoodsBackLineDto {
    sdniId: string;
    qty: string;
    sdeId?: string;
}
export declare class GoodsBackDto extends DeliveryNoteKeysDto {
    reason?: string;
    lines: GoodsBackLineDto[];
}
export declare class DeliveryNoteGetQueryDto extends DeliveryNoteKeysDto {
}
export declare class DeliveryScanQueryDto {
    companyId: string;
    branchId: string;
    godownId: string;
    code: string;
}
export declare class OpenLinesBillDto {
    billId: string;
    billAccYear: string;
}
export declare class OpenLinesDto {
    companyId: string;
    branchId: string;
    godownId: string;
    bills: OpenLinesBillDto[];
}
export declare class DeliveryLotsQueryDto {
    companyId: string;
    branchId: string;
    godownId: string;
    itemId: string;
    bucket?: string;
}
export declare class DeliveryModeDto {
    companyId: string;
    branchId: string;
    accYear: string;
    sbId: string;
    sbDeliveryMode: string;
    reason?: string;
}
export declare class DeliveryExceptionsQueryDto {
    companyId: string;
    branchId: string;
}
export declare const DELIVERY_QTY_PATTERN: RegExp;
