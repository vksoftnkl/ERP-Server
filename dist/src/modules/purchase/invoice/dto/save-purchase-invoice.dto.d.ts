export declare class PurchaseAllocDto {
    godownId?: string;
    bucket?: string;
    batchNo?: string;
    mfgDate?: string;
    expiryDate?: string;
    mrp?: number;
    salePrice?: number;
    serialNo?: string;
    warrantyTo?: string;
    sizeId?: string;
    colourId?: string;
    model?: string;
    qty: number;
    freeQty?: number;
}
export declare class PurchaseInvoiceLineDto {
    lineNo: number;
    itemId: string;
    uomId: string;
    grnItemId?: string;
    grnItemAccYear?: string;
    poItemId?: string;
    sisterSaleItemId?: string;
    sisterSaleItemAccYear?: string;
    poItemAccYear?: string;
    costIncl?: number;
    billedQty: number;
    receivedQty?: number;
    damagedQty?: number;
    freeQty?: number;
    rate: number;
    discPct?: number;
    discPerQty?: number;
    discAmt?: number;
    schPct?: number;
    schPerQty?: number;
    schAmt?: number;
    extraDiscAmt?: number;
    taxId?: string;
    cessPct?: number;
    cessPerUnit?: number;
    weight?: number;
    mrp?: number;
    sellA?: number;
    sellB?: number;
    sellC?: number;
    sellD?: number;
    markupAPct?: number;
    remarks?: string;
    allocs?: PurchaseAllocDto[];
}
export declare class PurchaseChargePayeeDto {
    partyId: string;
    amount?: number;
}
export declare class PurchaseChargeDto {
    chgId: string;
    rate?: number;
    amount?: number;
    payees?: PurchaseChargePayeeDto[];
}
export declare class PurchaseInvoiceHeaderDto {
    piId?: string;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
    sessionId?: string;
    supplierId: string;
    supplierInvNo: string;
    supplierInvDate: string;
    docDate: string;
    goodsReceivedOn?: string;
    godownId: string;
    mode?: string;
    creditDays?: number;
    invoiceAmountPrinted: number;
    tcsAmount?: number;
    ewbNo?: string;
    ewbDate?: string;
    irn?: string;
    ackNo?: string;
    remarks?: string;
    post?: boolean;
}
export declare class SavePurchaseInvoiceDto {
    header: PurchaseInvoiceHeaderDto;
    lines: PurchaseInvoiceLineDto[];
    charges?: PurchaseChargeDto[];
}
export declare class GetPurchaseInvoiceQueryDto {
    piId: string;
    accYear: string;
}
export declare class CancelPurchaseInvoiceDto {
    piId: string;
    accYear: string;
    reason: string;
}
export declare class GrnLinesQueryDto {
    companyId: string;
    branchId: string;
    supplierId: string;
    piId?: string;
}
export declare class PurchaseInvoiceHoldDto {
    piId: string;
    accYear: string;
    hold: boolean;
    reason: string;
}
export declare class PurchaseSettingsQueryDto {
    companyId: string;
    branchId: string;
}
