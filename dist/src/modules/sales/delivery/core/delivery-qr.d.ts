export type DeliveryQrKind = 'BILL' | 'NOTE';
export interface DeliveryQr {
    kind: DeliveryQrKind;
    id: string;
    accYear: string;
}
export declare function encodeDeliveryQr(kind: DeliveryQrKind, id: string, accYear: string): string;
export declare function deliveryQrCaption(token: string): string;
export declare function decodeDeliveryQr(raw: string): DeliveryQr | null;
export declare function looksLikeDeliveryQr(raw: string): boolean;
