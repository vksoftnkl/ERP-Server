import { HttpStatus } from '@nestjs/common';
export declare const PUR: {
    readonly NOT_FOUND: "PUR_NOT_FOUND";
    readonly SUPPLIER_NOT_FOUND: "PUR_SUPPLIER_NOT_FOUND";
    readonly ITEM_NOT_FOUND: "PUR_ITEM_NOT_FOUND";
    readonly UNIT_NOT_FOUND: "PUR_UNIT_NOT_FOUND";
    readonly CHARGE_NOT_FOUND: "PUR_CHARGE_NOT_FOUND";
    readonly NO_LINES: "PUR_NO_LINES";
    readonly QTY_INVALID: "PUR_QTY_INVALID";
    readonly ALLOC_SUM_MISMATCH: "PUR_ALLOC_SUM_MISMATCH";
    readonly DUPLICATE_SUPPLIER_INVOICE: "PUR_DUPLICATE_SUPPLIER_INVOICE";
    readonly INVOICE_AMOUNT_MISMATCH: "PUR_INVOICE_AMOUNT_MISMATCH";
    readonly NOT_DRAFT: "PUR_NOT_DRAFT";
    readonly NOT_POSTED: "PUR_NOT_POSTED";
    readonly EDIT_LOCKED_PAID: "PUR_EDIT_LOCKED_PAID";
    readonly OFFBILL_NO_PAYEE: "PUR_OFFBILL_NO_PAYEE";
    readonly OFFBILL_GTA_REFUSED: "PUR_OFFBILL_GTA_REFUSED";
    readonly MODE_NOT_SUPPORTED: "PUR_MODE_NOT_SUPPORTED";
    readonly VOUCHER_TYPE_MISSING: "PUR_VOUCHER_TYPE_MISSING";
    readonly STOCK_QTY_MISMATCH: "PUR_STOCK_QTY_MISMATCH";
    readonly SERIAL_COUNT: "PUR_SERIAL_COUNT";
};
export interface PurErrorDetail {
    field: string;
    code: string;
    message: string;
}
export declare function purRefuse(message: string, code: string, field?: string, status?: HttpStatus): never;
export declare function purRefuseMany(message: string, errors: PurErrorDetail[], status?: HttpStatus): never;
export declare function purNotFound(message: string, code?: string, field?: string): never;
export declare function purConflict(message: string, code: string, field?: string): never;
