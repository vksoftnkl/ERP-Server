export declare const TXN_DOC_TYPES: readonly ["OPENING_STOCK", "STOCK_ADJUSTMENT", "PHYSICAL_STOCK", "STOCK_TRANSFER", "STOCK_TRANSFER_RECEIPT", "SALE_BILL", "QUOTATION", "SALE_ORDER", "DELIVERY_CHALLAN", "DC_RETURN", "SALE_RETURN", "RECEIPT", "PAYMENT", "VOUCHER"];
export type TxnDocType = (typeof TXN_DOC_TYPES)[number];
export type TxnDocMenu = number | 'VOUCHER_TYPE';
export interface TxnDocSpec {
    label: string;
    table: string;
    join?: string;
    id: string;
    company: string;
    branch: string;
    year: string;
    date: string;
    serial: TxnDocSerial | null;
    createdOn: string;
    status: string;
    deleted: string;
    refno: string;
    type: string;
    types?: readonly string[];
    where?: string;
    statuses: readonly string[];
    menu: TxnDocMenu;
}
export interface TxnDocSerial {
    column: string;
    draft: 'LOW' | 'HIGH' | null;
}
export declare const TXN_DOC_REGISTRY: Readonly<Record<TxnDocType, TxnDocSpec>>;
