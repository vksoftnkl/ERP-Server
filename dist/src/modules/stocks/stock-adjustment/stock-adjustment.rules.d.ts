import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
export declare const STOCK_ADJUSTMENT_KINDS: readonly ["ADJUSTMENT", "ISSUE", "DAMAGE", "EXPIRY_WRITEOFF"];
export type StockAdjustmentKind = (typeof STOCK_ADJUSTMENT_KINDS)[number];
export declare function isStockAdjustmentKind(value: unknown): value is StockAdjustmentKind;
export declare const BUCKET_MOVE_KIND: "BUCKET_MOVE";
export declare const STOCK_ADJUSTMENT_SAVE_KINDS: readonly ["ADJUSTMENT", "ISSUE", "DAMAGE", "EXPIRY_WRITEOFF", "BUCKET_MOVE"];
export type StockAdjustmentSaveKind = (typeof STOCK_ADJUSTMENT_SAVE_KINDS)[number];
export declare const STOCK_ADJUSTMENT_DOC_KINDS: readonly ["ADJUSTMENT", "ISSUE", "DAMAGE", "EXPIRY_WRITEOFF", "RELOT", "BUCKET_MOVE"];
export type StockAdjustmentDocKind = (typeof STOCK_ADJUSTMENT_DOC_KINDS)[number];
export declare const BUCKET_MOVE_TXN_TYPES: readonly ["BUCKET_OUT", "BUCKET_IN"];
export declare const STOCK_ADJUSTMENT_RULES: Readonly<Record<StockAdjustmentSaveKind, StockVoucherTypeRules>>;
export declare const RELOT_OUT_CODE: string;
export declare const RELOT_IN_CODE: string;
export declare const MOVE_REASON_DEFAULT_BUCKET: {
    readonly MOVE_DAMAGED: "DAMAGED";
    readonly MOVE_SALEABLE: "SALEABLE";
};
export declare const EXPIRY_GRACE_SETTING_KEY = "stock.expiry_writeoff_grace_days";
