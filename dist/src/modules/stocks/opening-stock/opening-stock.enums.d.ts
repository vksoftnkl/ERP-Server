export declare const OpeningStockStatus: {
    readonly DRAFT: "DRAFT";
    readonly APPROVED: "APPROVED";
    readonly POSTED: "POSTED";
    readonly CANCELLED: "CANCELLED";
};
export type OpeningStockStatus = (typeof OpeningStockStatus)[keyof typeof OpeningStockStatus];
export declare const OpeningStockDeviceType: {
    readonly PC: "PC";
    readonly MOBILE: "MOBILE";
    readonly WEB: "WEB";
};
export type OpeningStockDeviceType = (typeof OpeningStockDeviceType)[keyof typeof OpeningStockDeviceType];
export declare const OpeningStockDetailTrackingType: {
    readonly NONE: "NONE";
    readonly MRP: "MRP";
    readonly BATCH: "BATCH";
};
export type OpeningStockDetailTrackingType = (typeof OpeningStockDetailTrackingType)[keyof typeof OpeningStockDetailTrackingType];
export declare const OpeningStockDetailCessType: {
    readonly NONE: "NONE";
    readonly PERCENT: "PERCENT";
    readonly PER_UNIT: "PER_UNIT";
};
export type OpeningStockDetailCessType = (typeof OpeningStockDetailCessType)[keyof typeof OpeningStockDetailCessType];
